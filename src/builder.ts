import { Counter, CounterOpts, Gauge, GaugeOpts, Handler, Tags } from "./metrics.js"

export class MetricsBuilder {
    protected namespace?: string
    protected tags: Tags
    protected handler: Handler

    public constructor({namespace, tags, handler}: {namespace?: string, tags?: Tags, handler: Handler}) {
        this.namespace = namespace
        this.tags = tags || {}
        this.handler = handler
    }

//    public createCounter(name: string, description: string, tags: Tags)
    public createCounter(opts: Omit<CounterOpts, 'handler'>): Counter {
        return new Counter({
            ...opts,
            name: [this.namespace, opts.name].filter(Boolean).join('.'),
            tags: {...this.tags, ...opts.tags},
            handler: this.handler
        })
    }

    public createGauge(opts: Omit<GaugeOpts, 'handler'>): Gauge {
        return new Gauge({
            ...opts,
            name: [this.namespace, opts.name].filter(Boolean).join('.'),
            tags: {...this.tags, ...opts.tags},
            handler: this.handler
        })
    }

    public child(subnamespace: string, tags?: Tags): MetricsBuilder
    public child(subnamespace: undefined | null, tags: Tags): MetricsBuilder
    public child(subnamespace: string | undefined | null, tags?: Tags): MetricsBuilder {
        return new MetricsBuilder({
            handler: this.handler,
            namespace: [this.namespace, subnamespace].filter(Boolean).join('.'),
            tags: {...this.tags, ...tags}
        })
    }
}
