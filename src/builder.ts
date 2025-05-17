import { Counter, CounterOpts, Gauge, GaugeOpts, Handler, Tags } from "./metrics.js"

export class MetricsBuilder {
    protected namespace?: string
    protected tags: Tags
    protected handlers: Handler[]

    public constructor({namespace, tags, handlers}: {namespace?: string, tags?: Tags, handlers: Handler[]}) {
        this.namespace = namespace
        this.tags = tags || {}
        this.handlers = handlers
    }

    public counter(opts: Omit<CounterOpts, 'handlers' | 'tags'>): Counter {
        return new Counter({
            ...opts,
            name: [this.namespace, opts.name].filter(Boolean).join('.'),
            tags: {...this.tags/*, ...opts.tags*/},
            handlers: this.handlers
        })
    }

    public gauge(opts: Omit<GaugeOpts, 'handlers' | 'tags'>): Gauge {
        return new Gauge({
            ...opts,
            name: [this.namespace, opts.name].filter(Boolean).join('.'),
            tags: {...this.tags/*, ...opts.tags*/},
            handlers: this.handlers
        })
    }

    public child(subnamespace: string, tags?: Tags): MetricsBuilder
    public child(subnamespace: undefined | null, tags: Tags): MetricsBuilder
    public child(subnamespace: string | undefined | null, tags?: Tags): MetricsBuilder {
        return new MetricsBuilder({
            handlers: this.handlers,
            namespace: [this.namespace, subnamespace].filter(Boolean).join('.'),
            tags: {...this.tags, ...tags}
        })
    }
}
