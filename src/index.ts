import EventEmitter from 'events'
import { TypedEmitter } from 'tiny-typed-emitter'

export interface MetricOpts {
    name: string
    description: string
    tags: Record<string, string>
}

export type MetricEvents = {
    change: (value: number) => void
}

export abstract class Metric extends (EventEmitter as new () => TypedEmitter<MetricEvents>) {
    protected name: string
    protected abstract type: string
    protected description: string
    protected tags: Record<string, string>

    public constructor({name, description, tags}: MetricOpts) {
        super()
        this.name = name
        this.description = description
        this.tags = tags
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

    public async collect() {
        // this.emit('collect') with async
    }

    public onCollect(fn: () => Promise<void>) {
        this.collect = fn
    }
}

export interface CounterOpts extends MetricOpts {}

export class Counter extends Metric {
    type = 'counter'
    public increment(value?: number) {
        this.emit('change', value ?? 1)
    }
}

export interface GaugeOpts extends MetricOpts {}

export class Gauge extends Metric {
    type = 'gauge'
    public set(value: number) {
        this.emit('change', value)
    }
}

type MetricHandlerEvents = {
    collect: (promises: Promise<void>[]) => void
}

export interface MetricHandler extends TypedEmitter<MetricHandlerEvents> {
    handleMetricChange(metric: Metric, value: number): void
}

export class Metrics {
    protected metrics: Metric[] = []
    protected handlers: MetricHandler[]

    public constructor({handlers}: {handlers: MetricHandler[]}) {
        this.handlers = handlers

        this.handlers.forEach(handler => {
            handler.on('collect', (promises) => {
                promises.push((async () => {
                    await Promise.all(this.metrics.map(metric => metric.collect()))
                })())
            })
        })
    }

    public createCounter(opts: CounterOpts): Counter {
        return this.register(new Counter(opts))
    }

    public createGauge(opts: GaugeOpts): Gauge {
        return this.register(new Gauge(opts))
    }

    protected register<T extends Metric>(metric: T): T {
        if (this.metrics.find(m => m.getName() === metric.getName())) {
            throw new Error('Metric with same name already registered')
        }
        this.metrics.push(metric)
        metric.on('change', (value) => this.dispatchChange(metric, value))
        return metric
    }

    protected dispatchChange(metric: Metric, value: number) {
        this.handlers.forEach(handler => handler.handleMetricChange(metric, value))
    }
}
