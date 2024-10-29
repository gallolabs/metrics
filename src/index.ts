/*
* Guide https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md
*/
import {
    Counter, CounterConfiguration, Gauge, GaugeConfiguration, Histogram, HistogramConfiguration,
    Metric, Registry as PromRegistry, Summary, SummaryConfiguration, openMetricsContentType
} from 'prom-client'
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import EventEmitter from 'events'
import { TypedEmitter } from 'tiny-typed-emitter'

export type CounterOpts = Omit<CounterConfiguration<any>, 'registers' | 'aggregator'>
export type GaugeOpts = Omit<GaugeConfiguration<any>, 'registers' | 'aggregator'>
export type HistogramOpts = Omit<HistogramConfiguration<any>, 'registers' | 'aggregator'>
export type SummaryOpts = Omit<SummaryConfiguration<any>, 'registers' | 'aggregator'>

export class MetricsUserFriendlyInterface {
    protected registry: MetricsRegistry

    public constructor(registry: MetricsRegistry) {
        this.registry = registry
    }

    public createCounter(configuration: CounterOpts) {
        return this.register(
            new Counter({...configuration, registers: []})
        )
    }

    public createGauge(configuration: GaugeOpts) {
        return this.register(
            new Gauge({...configuration, registers: []})
        )
    }

    public createHistogram(configuration: HistogramOpts) {
        return this.register(
            new Histogram({...configuration, registers: []})
        )
    }

    public createSummary(configuration: SummaryOpts) {
        return this.register(
            new Summary({...configuration, registers: []})
        )
    }

    protected register<M extends Metric>(metric: M): M {
        this.registry.register(metric)

        return metric
    }

    // public child/scope (prefix) => Sub Class of MetricsRegistry without all methods and targetting same promRegistry ?
}

export class MetricsRegistry {
    protected promRegistry = new PromRegistry

    public register(metric: Metric) {
        this.promRegistry.registerMetric(metric)
    }
}

export class MetricsFormatter {
    public getContentType() {
        return openMetricsContentType
    }

    public async format(registry: MetricsRegistry) {
        // Bad arch : Registry and dumper should not be the same
        const promRegistry = registry['promRegistry']
        // Cool ... Typescript is pooply implemented
        promRegistry.setContentType(this.getContentType() as any)

        return await promRegistry.metrics()
    }
}

export type MetricsServerEvents = {
    warning: (error: MetricsServerError) => void
    error: (error: MetricsServerError) => void
    request: (request: FastifyRequest) => void
    response: (response: FastifyReply) => void
}

export interface MetricsServerErrorDetails {
    request: FastifyRequest
}

export class MetricsServerError extends Error {
    name = 'ServerError'
    request: FastifyRequest
    constructor(message: string, options: ErrorOptions & MetricsServerErrorDetails) {
        super(message, {cause: options.cause})
        this.request = options.request
    }
}

export class MetricsServer extends (EventEmitter as new () => TypedEmitter<MetricsServerEvents>) {
    protected registry: MetricsRegistry
    protected formatter: MetricsFormatter
    protected server: FastifyInstance
    protected port: number

    //public on(eventName: 'request', listener: (...args: any[]) => void): this

    public constructor(
        {registry, uidGenerator, formatter, port}:
        {registry: MetricsRegistry, formatter: MetricsFormatter, uidGenerator?: () => string, port?: number}
    ) {
        super()
        this.registry = registry
        this.formatter = formatter
        this.server = Fastify({
            genReqId: uidGenerator || (() => Math.random().toString(36).substring(2))
        })
        this.port = port || 9090

        this.server.addHook('onRequest', async (request) => {
            this.emit('request', request)
        })

        this.server.addHook('onError', async (request, __, error) => {
            this.emit('error', new MetricsServerError(error.message, {cause: error, request}))
        })

        this.server.addHook('onResponse', async (request, reply) => {
            this.emit('response', reply)
            // "As a rule of thumb, exposition SHOULD take no more than a second."
            if (reply.elapsedTime > 1000) {
                this.emit(
                    'warning',
                    new MetricsServerError(
                        'Response too slow following OpenMetrics specs. Expected <= 1000ms, given '
                        + (reply.elapsedTime > 1001 ? Math.floor(reply.elapsedTime) : Math.ceil(reply.elapsedTime)).toString()
                        + 'ms',
                        { request }
                    )
                )
            }
        })
        this.server.get('/metrics', async (_, reply) => reply.type(this.formatter.getContentType()).send(await this.formatter.format(this.registry)))
    }

    public async start(abortSignal?: AbortSignal) {
        // Warn listening can probably be false even if start has been called. To fix
        if (this.server.server.listening) {
            throw new Error('Server already running')
        }

        await this.server.listen({port: this.port, signal: abortSignal})
    }

    public async stop() {
        await this.server.close()
    }
}