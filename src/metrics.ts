export type Tags = Record<string, string>

export interface Handler {
    handleUpdate(metric: Metric, value: number): void
    register(metric: Metric): void
}

export interface MetricOpts {
    name: string
    description: string
    tags: Tags
    handler: Handler
    onCollect: () => Promise<void>
}

export abstract class Metric  {
    protected name: string
    protected abstract type: string
    protected description: string
    protected tags: Record<string, string>
    protected handler: Handler

    public constructor({name, description, tags, handler, onCollect}: MetricOpts) {
        this.name = name
        this.description = description
        this.tags = tags
        this.handler = handler

        handler.register(this)

        if (onCollect) {
            this.onCollect(onCollect)
        }
    }

    public getName() {
        return this.name
    }

    public getType() {
        return this.type
    }

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

    public onCollect(fn: () => Promise<void>) {
        this.collect = fn
    }
}

export interface CounterOpts extends MetricOpts {}

export class Counter extends Metric {
    type = 'counter'
    public increment(value?: number) {
        this.handler.handleUpdate(this, value ?? 1)
    }
}

export interface GaugeOpts extends MetricOpts {}

export class Gauge extends Metric {
    type = 'gauge'
    public set(value: number) {
        this.handler.handleUpdate(this, value)
    }
}
