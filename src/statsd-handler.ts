import { Metric } from "./metrics.js"
import {StatsD} from 'hot-shots'
import {BaseHandler} from './handler.js'

export class StatsdHandler extends BaseHandler<{}> {
    protected statsd
    protected collectInterval: number

    public constructor({collectInterval}: {collectInterval?: number} = {}) {
        super()
        this.collectInterval = collectInterval || 10000
        this.statsd = new StatsD({
            protocol: 'tcp'

        })
        //this.statsd.close()
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
        const e = setInterval(() => this.collect(), this.collectInterval)
        abortSignal.addEventListener('abort', () => clearInterval(e))
    }

}
