/*
* Guide https://github.com/OpenObservability/OpenMetrics/blob/main/specification/OpenMetrics.md
*/
import {
    Counter, Gauge, Registry as PromRegistry, openMetricsContentType
} from 'prom-client'
import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { BaseHandler } from './handler.js'
import { Metric } from './metrics.js'
import {uniq} from 'lodash-es'

export type MetricsServerEvents = {
    warning: [MetricsServerError]
    error: [MetricsServerError]
    request: [FastifyRequest]
    response: [FastifyReply]
}

export class OpenMetricsHandler extends BaseHandler<MetricsServerEvents> {
	protected registry = new PromRegistry()
    protected server: FastifyInstance
    protected port: number

    public constructor(
        {uidGenerator, port}:
        {uidGenerator?: () => string, port?: number} = {}
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

    public register(metric: Metric): void {
        super.register(metric)

        let promMetric = this.registry.getSingleMetric(this.convertName(metric.getName()))
        if (!promMetric) {
            switch(metric.getType()) {
                case 'counter':
                    promMetric = new Counter({
                        name: this.convertName(metric.getName()),
                        help: metric.getDescription(),
                        labelNames: Object.keys(metric.getTags()).length === 0 ? ['abc'] : Object.keys(metric.getTags()),
                        registers: []
                    })
                    this.registry.registerMetric(promMetric)
                    break
                case 'gauge':
                    promMetric = new Gauge({
                        name: this.convertName(metric.getName()),
                        help: metric.getDescription(),
                        labelNames: Object.keys(metric.getTags()).length === 0 ? ['abc'] : Object.keys(metric.getTags()),
                        registers: []
                    })
                    this.registry.registerMetric(promMetric)
                    break
                default:
                    throw new Error('Unhandled metric type ' + metric.getType())
            }
        } else {
            (promMetric as any).labelNames = uniq((promMetric as any).labelNames.concat(Object.keys(metric.getTags()))).sort()
            ;(promMetric as any).sortedLabelNames = (promMetric as any).labelNames.sort()
        }
    }

    public handleUpdate(metric: Metric, value: number): void {
        const promMetric = this.registry.getSingleMetric(this.convertName(metric.getName()))

    	switch(metric.getType()) {
			case 'counter':
				(promMetric as Counter).inc(metric.getTags(), value)
                break
			case 'gauge':
				(promMetric as Gauge).set(metric.getTags(), value)
                break
		}

    }

    protected convertName(name: string[]) {
        return name.map(part => part.replace(/_/g, '_')).join('_')
    }

    protected getContentType() {
        return openMetricsContentType
    }

    public async format() {
        // Cool ... Typescript is pooply implemented
        this.registry.setContentType(this.getContentType() as any)

        await this.collect()

        return await this.registry.metrics()
    }
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
