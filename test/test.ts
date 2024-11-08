import assert from 'assert'
import {MetricsRegistry, MetricsUserFriendlyInterface, MetricsServer, MetricsFormatter} from './index.js'
import {setTimeout} from 'timers/promises'

describe('open-metric', () => {
    it('test', async() => {

        const metricsRegistry = new MetricsRegistry
        const metrics = new MetricsUserFriendlyInterface(metricsRegistry)
        const metricsServer = new MetricsServer({
            formatter: new MetricsFormatter,
            registry: metricsRegistry
        })

        metricsServer.on('request', (request) => {
            console.log('Received request', request.id, request.url)
        })

        metricsServer.on('response', (response) => {
            console.log('Returned response', response.request.id)
        })

        metricsServer.on('error', (error) => {
            console.log('Errorrr !!!', error)
        })

        metricsServer.on('warning', (warning) => {
            console.log('Warning !', warning.message, warning.request.id)
        })

        const abortController = new AbortController
        await metricsServer.start(abortController.signal)

        const tickCounter = metrics.createCounter({
            help: 'Number of called interval',
            name: 'called_count'
        })

        const randoms = [44, 88, 22, 99]
        let randomI = 0

        metrics.createGauge({
            help: 'Random value',
            name: 'random',
            async collect() {
                if (randomI === 1) {
                    await setTimeout(1000)
                }
                this.set(randoms[randomI++])
            }
        })

        const httpInputHistogram = metrics.createHistogram({
            help: 'Input Http Requests',
            name: 'input_http',
            buckets: [40, 100, 500]
        })

        tickCounter.inc()
        httpInputHistogram.observe(150)
        tickCounter.inc()
        httpInputHistogram.observe(32)

        await fetch('http://localhost:9090/metrics')
        const v = await fetch('http://localhost:9090/metrics')

        abortController.abort()

        assert.strictEqual(v.headers.get('content-type'), 'application/openmetrics-text; version=1.0.0; charset=utf-8')

        assert.strictEqual(
            await v.text(),
`# HELP called_count Number of called interval
# TYPE called_count counter
called_count_total 2
# HELP random Random value
# TYPE random gauge
random 88
# HELP input_http Input Http Requests
# TYPE input_http histogram
input_http_bucket{le="40"} 1
input_http_bucket{le="100"} 1
input_http_bucket{le="500"} 2
input_http_bucket{le="+Inf"} 2
input_http_sum 182
input_http_count 2
# EOF
`
        )

    })
})
