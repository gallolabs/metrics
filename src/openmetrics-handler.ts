/*
* Guide https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md
*/
import {
    Counter, Gauge, Registry as PromRegistry, openMetricsContentType
} from 'prom-client'
import {MetricHandler, Metric} from './index.js'
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import EventEmitter from 'events'
import { TypedEmitter } from 'tiny-typed-emitter'

export class OpenMetricsHandler extends (EventEmitter as new () => TypedEmitter<OpenMetricsHandlerEvents>) implements MetricHandler  {
	protected registry = new PromRegistry()
    protected server: FastifyInstance
    protected port: number

    public constructor(
        {uidGenerator, port}:
        {uidGenerator?: () => string, port?: number}
    ) {
        super()
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
        this.server.get('/metrics', async (_, reply) => reply.type(this.getContentType()).send(await this.format()))
    }

    public async startServer(abortSignal?: AbortSignal) {
        // Warn listening can probably be false even if start has been called. To fix
        if (this.server.server.listening) {
            throw new Error('Server already running')
        }

        await this.server.listen({port: this.port, signal: abortSignal})
    }

    public async stopServer() {
        await this.server.close()
    }

    public handleMetricChange(metric: Metric, value: number): void {
    	let promMetric = this.registry.getSingleMetric(metric.getName())

    	if (!promMetric) {
    		switch(metric.getType()) {
    			case 'counter':
    				promMetric = new Counter({
    					name: metric.getName(),
    					help: metric.getDescription()
    				})
    				this.registry.registerMetric(promMetric)
				case 'gauge':
					promMetric = new Gauge({
						name: metric.getName(),
    					help: metric.getDescription()
					})
    				this.registry.registerMetric(promMetric)
				default:
					throw new Error('Unhandled metric type')
    		}
    	}

    	switch(metric.getType()) {
			case 'counter':
				(promMetric as Counter).inc(value)
			case 'gauge':
				(promMetric as Gauge).set(metric.getTags(), value)
		}

    }

    protected getContentType() {
        return openMetricsContentType
    }

    protected async format() {
        // Cool ... Typescript is pooply implemented
        this.registry.setContentType(this.getContentType() as any)

        await this.collect()

        return await this.registry.metrics()
    }

    protected async collect() {
        const promises: Promise<void>[] = []
        this.emit('collect', promises)
        await Promise.all(promises)
    }
}

export type MetricsServerEvents = {
    warning: (error: MetricsServerError) => void
    error: (error: MetricsServerError) => void
    request: (request: FastifyRequest) => void
    response: (response: FastifyReply) => void
}

export type OpenMetricsHandlerEvents = MetricsServerEvents & {
    collect: (promises: Promise<void>[]) => void
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
