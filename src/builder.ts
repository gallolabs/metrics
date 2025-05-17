import { Counter, CounterOpts, Gauge, GaugeOpts, Handler, Tags } from "./metrics.js"

export class MetricsBuilder {
    protected namespace: string[]
    protected tags: Tags
    protected handlers: Handler[]
    protected flatNamesSeparator: string

    public constructor(
        {namespace, tags, handlers, flatNamesSeparator}:
        {namespace?: string[] | string, tags?: Tags, handlers: Handler[], flatNamesSeparator?: string}
    ) {
        if (typeof namespace === 'string') {
            namespace = this.splitName(namespace)
        }
        this.namespace = namespace || []
        this.tags = tags || {}
        this.handlers = handlers
        this.flatNamesSeparator = flatNamesSeparator || '.'
    }

    public counter(opts: Omit<CounterOpts, 'handlers' | 'tags' | 'name'> & {name: string | string[]}): Counter {
        const name = typeof opts.name === 'string' ? this.splitName(opts.name) : opts.name

        return new Counter({
            ...opts,
            name: [...this.namespace, ...name],
            tags: {...this.tags/*, ...opts.tags*/},
            handlers: this.handlers
        })
    }

    public gauge(opts: Omit<GaugeOpts, 'handlers' | 'tags' | 'name'> & {name: string | string[]}): Gauge {
        const name = typeof opts.name === 'string' ? this.splitName(opts.name) : opts.name

        return new Gauge({
            ...opts,
            name: [...this.namespace, ...name],
            tags: {...this.tags/*, ...opts.tags*/},
            handlers: this.handlers
        })
    }

    public child(subnamespace: string[] | string, tags?: Tags): MetricsBuilder
    public child(subnamespace: undefined | null, tags: Tags): MetricsBuilder
    public child(subnamespace: string[] | string | undefined | null, tags?: Tags): MetricsBuilder {
        if (typeof subnamespace === 'string') {
            subnamespace = this.splitName(subnamespace)
        }
        return new MetricsBuilder({
            handlers: this.handlers,
            namespace: [...this.namespace, ...(subnamespace || [])],
            tags: {...this.tags, ...tags}
        })
    }

    protected splitName(name: string): string[] {
        return name.split(this.flatNamesSeparator)
    }
}
