import { Metric } from "./metrics.js"
import {StatsD} from 'hot-shots'
import {BaseHandler} from './handler.js'

export class StatsdHandler extends BaseHandler<{}> {
    protected statsd

    public constructor() {
        super()
        this.statsd = new StatsD
    }

    public handleUpdate(metric: Metric, value: number): void {
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

    public startCollect(abortSignal: AbortSignal) {
        const e = setInterval(() => this.collect(), 10000)
        abortSignal.addEventListener('abort', () => clearInterval(e))
    }

}
