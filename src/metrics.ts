export type Tags = Record<string, string>

export interface Handler {
    handleUpdate(metric: Metric, value: number): void
    register(metric: Metric): void
}

export interface MetricOpts {
    name: string
    description: string
    tags?: Tags
    handler: Handler
    onCollect?: (self: Metric) => Promise<void> | void
}

export abstract class Metric  {
    protected name: string
    protected description: string
    protected tags: Record<string, string>
    protected handler: Handler

    public constructor({name, description, tags, handler, onCollect}: MetricOpts) {
        this.name = name
        this.description = description
        this.tags = tags || {}
        this.handler = handler

        handler.register(this)

        if (onCollect) {
            this.onCollect(onCollect)
        }
    }

    public getName() {
        return this.name
    }

    public abstract getType(): string

    public getTags() {
        return this.tags
    }

    public getDescription() {
        return this.description
    }

    public getHandler() {
        return this.handler
    }

    public async collect() {
    }

    public onCollect(fn: (self: Metric) => Promise<void> | void) {
        this.collect = async () => fn(this)
    }
}

export interface CounterOpts extends MetricOpts {}

export class Counter extends Metric {
    public increment(value?: number, tags?: Tags) {
        if (tags) {
            this.withTags(tags).increment(value)
        } else {
            this.handler.handleUpdate(this, value ?? 1)
        }
    }

    public getType(): string {
        return 'counter'
    }

    public withTags(tags: Tags) {
        return new Counter({
            name: this.name,
            description: this.description,
            tags: {...this.tags, ...tags},
            handler: this.handler
        })
    }
}

export interface GaugeOpts extends MetricOpts {}

export class Gauge extends Metric {
    public set(value: number, tags?: Tags) {
        if (tags) {
            this.withTags(tags).set(value)
        } else {
            this.handler.handleUpdate(this, value)
        }
    }

    public getType(): string {
        return 'gauge'
    }

    public withTags(tags: Tags) {
        return new Gauge({
            name: this.name,
            description: this.description,
            tags: {...this.tags, ...tags},
            handler: this.handler,
        })
    }
}
