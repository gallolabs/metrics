import assert from 'assert'
import { Gauge, MetricsBuilder, OpenMetricsHandler, StatsdHandler } from '../src/index.js'
import {setTimeout} from 'timers/promises'
import net from 'net'

describe('metrics', () => {
    it('multi handlers', async() => {
        const handler1 = new OpenMetricsHandler({port: 4000})
        const handler2 = new OpenMetricsHandler({port: 5000})
        const builder = new MetricsBuilder({handlers: [handler1, handler2]})

        const abortController = new AbortController
        await handler1.startServer(abortController.signal)
        await handler2.startServer(abortController.signal)

        const counter = builder.counter({
            name: 'job.success',
            description: 'Job total success'
        })

        counter.increment()

        const v1a = await fetch('http://localhost:4000/metrics')
        const v1b = await fetch('http://localhost:4000/metrics')

        abortController.abort()

        assert.strictEqual(await v1a.text(), await v1b.text())
    })

    it('open metrics', async () => {
        const handler = new OpenMetricsHandler
        const builder = new MetricsBuilder({handlers: [handler]})

        const abortController = new AbortController
        await handler.startServer(abortController.signal)

        const counter = builder.counter({
            name: 'job.success',
            description: 'Job total success'
        })

        const v0 = await fetch('http://localhost:9090/metrics')

        assert.strictEqual(v0.headers.get('content-type'), 'application/openmetrics-text; version=1.0.0; charset=utf-8')
        assert.strictEqual(
            await v0.text(),
`# HELP job_success Job total success
# TYPE job_success counter
# EOF
`
        )

        counter.increment(0)

        const v1 = await fetch('http://localhost:9090/metrics')

        assert.strictEqual(v1.headers.get('content-type'), 'application/openmetrics-text; version=1.0.0; charset=utf-8')
        assert.strictEqual(
            await v1.text(),
`# HELP job_success Job total success
# TYPE job_success counter
job_success_total 0
# EOF
`
        )

        counter.increment()

        const v2 = await fetch('http://localhost:9090/metrics')

        assert.strictEqual(v2.headers.get('content-type'), 'application/openmetrics-text; version=1.0.0; charset=utf-8')
        assert.strictEqual(
            await v2.text(),
`# HELP job_success Job total success
# TYPE job_success counter
job_success_total 1
# EOF
`
        )

        const hostMetricsBuilder = builder.child('host', { host: '172.0.0.1' })

        hostMetricsBuilder.gauge({
            name: 'cpu',
            description: 'CPU measurement',
        }).withTags({ measureMethod: 'good' }).set(77)

        const v3 = await fetch('http://localhost:9090/metrics')

        assert.strictEqual(v3.headers.get('content-type'), 'application/openmetrics-text; version=1.0.0; charset=utf-8')
        assert.strictEqual(
            await v3.text(),
`# HELP job_success Job total success
# TYPE job_success counter
job_success_total 1
# HELP host_cpu CPU measurement
# TYPE host_cpu gauge
host_cpu{host="172.0.0.1",measureMethod="good"} 77
# EOF
`
        )

        abortController.abort()
    })

    it('Statsd', async () => {
        let received: string[] = []
        const abortController = new AbortController

        const s = net.createServer(function(socket) {
            abortController.signal.addEventListener('abort', () => socket.end())
            socket.on('data', (data) => {
                received.push(data.toString())
            })
        });

        s.listen(8125)

        const handler = new StatsdHandler({
            collectInterval: 500,
            rewrites: {
                'job.status': 'job.status.${status}'
            }
        })
        const builder = new MetricsBuilder({handlers: [handler]})

        const counter = builder.child('app', {appId: '24'}).counter({
            name: 'job.success',
            description: 'Job total success',
        }).withTags({jobType: 'wall'})

        counter.increment()

        await setTimeout(200)

        assert.strictEqual(received.length, 1)
        assert.strictEqual(received[0], 'app.job.success:1|c|#appId:24,jobType:wall\n')

        received = []

        builder.counter({
            name: 'job.status',
            description: 'Job status'
        }).withTags({status: 'success'}).increment()

        await setTimeout(200)

        assert.strictEqual(received.length, 1)
        assert.strictEqual(received[0], 'job.status.success:1|c\n')

        received = []

        builder.gauge({
            name: 'cpu',
            description: 'CPU load',
            onCollect(gauge) {
                (gauge as Gauge).set(78)
            }
        }).withTags({machin: 'truc'})


        handler.startCollect(abortController.signal)

        await setTimeout(300)
        assert.strictEqual(received.length, 0)

        await setTimeout(300)

        assert.strictEqual(received.length, 1)
        assert.strictEqual(received[0], 'cpu:78|g\n')

        received = []

        s.close()
        abortController.abort()
    })
})