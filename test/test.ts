import assert from 'assert'
import { Gauge, MetricsBuilder, OpenMetricsHandler, StatsdHandler } from '../src/index.js'
import {setTimeout} from 'timers/promises'
import net from 'net'

describe('metrics', () => {
    it('open metrics', async () => {
        const handler = new OpenMetricsHandler
        const builder = new MetricsBuilder({handler})

        const abortController = new AbortController
        await handler.startServer(abortController.signal)

        const counter = builder.counter({
            name: 'job.success',
            description: 'Job total success'
        })

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
            description: 'CPU measurement'
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

        const handler = new StatsdHandler({collectInterval: 500})
        const builder = new MetricsBuilder({handler})

        const counter = builder.counter({
            name: 'job.success',
            description: 'Job total success',
        }).withTags({jobType: 'wall'})

        counter.increment()

        await setTimeout(200)

        assert.strictEqual(received.length, 1)
        assert.strictEqual(received[0], 'job.success:1|c|#jobType:wall\n')

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