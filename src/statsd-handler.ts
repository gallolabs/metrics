import {StatsD} from 'hot-shots'
import {MetricHandler, Metric} from './index.js'
import { TypedEmitter } from 'tiny-typed-emitter'
import EventEmitter from 'events'

type StatsdHandlerEvents = {
collect: (promises: Promise<void>[]) => void
}

export class StatsdHandler extends (EventEmitter as new () => TypedEmitter<StatsdHandlerEvents>) implements MetricHandler {
    protected statsd

    public constructor() {
        super()
        this.statsd = new StatsD
    }

    public handleMetricChange(metric: Metric, value: number): void {
        switch(metric.getType()) {
            case 'counter':
                this.statsd.increment(metric.getName(), value, metric.getTags())
                break
            case 'gauge':
                this.statsd.gauge(metric.getName(), value, metric.getTags())
                break
            default:
                throw new Error('Unhandled ' + metric.getType())
        }
    }

    protected startCollect(abortSignal: AbortSignal) {
        const e = setInterval(() => this.collect(), 10000)
        abortSignal.addEventListener('abort', () => clearInterval(e))
    }

    protected async collect() {
        const promises: Promise<void>[] = []
        this.emit('collect', promises)
        await Promise.all(promises)
    }
}
