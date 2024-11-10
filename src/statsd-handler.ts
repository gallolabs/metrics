import { Metric } from "./metrics.js"
import {StatsD} from 'hot-shots'
import {BaseHandler} from './handler.js'
import {template} from 'lodash-es'

export type StatsDNoTagsRewrites = Record<string, string>

export class StatsdHandler extends BaseHandler<{}> {
    protected statsd
    protected collectInterval: number
    protected rewrites: StatsDNoTagsRewrites

    public constructor({collectInterval, rewrites}: {collectInterval?: number, rewrites?: StatsDNoTagsRewrites} = {}) {
        super()
        this.collectInterval = collectInterval || 10000
        this.statsd = new StatsD({
            protocol: 'tcp'
        })
        this.rewrites = rewrites || {}
        //this.statsd.close()
    }

    public handleUpdate(metric: Metric, value: number): void {
        let name = metric.getName()
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
