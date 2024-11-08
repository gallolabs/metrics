import { Handler, Metric } from "./metrics.js"
import EventEmitter from 'events'

export abstract class BaseHandler<T extends Record<keyof T, any[]>> extends EventEmitter<T> implements Handler {
    protected metrics: Metric[] = []

    public register(metric: Metric) {
        if (metric.getHandler() !== this) {
            throw new Error('Invalid two way handler set')
        }

        // if (this.metrics.find(m => m.getName() === metric.getName())) {
        //     throw new Error('Metric with same name already registered')
        // }

        this.metrics.push(metric)
    }

    public abstract handleUpdate(metric: Metric, value: number): void

    protected async collect() {
        await Promise.all(
            this.metrics.map(metric => metric.collect())
        )
    }
}



// export class MultiHandler extends Handler {

// }


// export class MetricsRootHandler {
//     protected metrics: Metric[] = []
//     protected handlers: MetricHandler[]

//     public constructor({handlers}: {handlers: MetricHandler[]}) {
//         this.handlers = handlers

//         this.handlers.forEach(handler => {
//             handler.on('collect', (promises) => {
//                 promises.push((async () => {
//                     await Promise.all(this.metrics.map(metric => metric.collect()))
//                 })())
//             })
//         })
//     }

//     public register<T extends Metric>(metric: T): T {
//         if (this.metrics.find(m => m.getName() === metric.getName())) {
//             throw new Error('Metric with same name already registered')
//         }
//         this.metrics.push(metric)
//         metric.on('change', (value) => this.dispatchChange(metric, value))
//         return metric
//     }

//     protected dispatchChange(metric: Metric, value: number) {
//         this.handlers.forEach(handler => handler.handleMetricChange(metric, value))
//     }
// }
