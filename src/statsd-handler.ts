import { Metric } from "./metrics.js"
import {StatsD} from 'hot-shots'
import {BaseHandler} from './handler.js'
import {template} from 'lodash-es'

export type StatsDNoTagsRewrites = Record<string, string>

export interface StatsdHandlerOpts {
    collectInterval?: number,
    rewrites?: StatsDNoTagsRewrites
    protocol?: 'tcp' | 'udp'
    host?: string
    port?: number
    cacheDnsTtl?: number
    bufferMaxSize?: number
    bufferFlushInterval?: number
}

export class StatsdHandler extends BaseHandler<{error: [Error]}> {
    protected statsd
    protected collectInterval: number
    protected rewrites: StatsDNoTagsRewrites

    public constructor(opts: StatsdHandlerOpts = {}) {
        super()
        this.collectInterval = opts.collectInterval || 10000
        this.statsd = new StatsD({
            protocol: opts.protocol || 'tcp',
            host: opts.host,
            port: opts.port,
            errorHandler: (error: Error) => {
                this.emit('error', error)
            },
            cacheDns: opts.cacheDnsTtl === 0 ? false : true,
            cacheDnsTtl: opts.cacheDnsTtl ?? 30000,
            maxBufferSize: opts.bufferMaxSize || 512, // UDP 65507, STATSD 512 ?
            bufferFlushInterval: opts.bufferFlushInterval || 1000
        })
        this.rewrites = opts.rewrites || {}
        //this.statsd.close()
    }

    public handleUpdate(metric: Metric, value: number): void {
        let name = metric.getName().map(part => part.replace(/\.|:/g, '-')).join('.')
        let tags = metric.getTags()

        if (this.rewrites[name]) {
            name = template(this.rewrites[name])(tags)
            tags = {}
        }

        switch(metric.getType()) {
            case 'counter':
                this.statsd.increment(name, value, tags)
                break
            case 'gauge':
                this.statsd.gauge(name, value, tags)
                break
            default:
                throw new Error('Unhandled ' + metric.getType())
        }
    }

    public startCollect(abortSignal: AbortSignal) {
        const e = setInterval(() => this.collect(), this.collectInterval)
        abortSignal.addEventListener('abort', () => clearInterval(e))
    }
}
