import assert from 'assert'
import { MetricsBuilder, OpenMetricsHandler } from '../src/index.js'
//import {setTimeout} from 'timers/promises'

describe('open-metric', () => {
    it('open metrics', async () => {
        const handler = new OpenMetricsHandler
        const builder = new MetricsBuilder({handler})

        const abortController = new AbortController
        await handler.startServer(abortController.signal)

        const counter = builder.createCounter({
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

        const billingBuilder = builder.child('host', { host: '172.0.0.1' })

        billingBuilder.createGauge({
            name: 'cpu',
            description: 'CPU measurement',
            tags: { measureMethod: 'good' }
        }).set(77)

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
})