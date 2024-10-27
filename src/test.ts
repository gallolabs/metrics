import {MetricsRegistry, MetricsUserFriendlyInterface, MetricsServer} from './index.js'


        const metricsRegistry = new MetricsRegistry
        const metrics = new MetricsUserFriendlyInterface(metricsRegistry)
        const metricsServer = new MetricsServer({
            uidGenerator,
            formatter: new MetricsFormatter,
            registry: metricsRegistry
        })
        const metricsLogger = fwkLogger.child('metrics')

        metricsServer.on('request', (request) => {
            metricsLogger.debug('Request')
        })

        metricsServer.on('response', (request, response) => {

        })

        metricsServer.on('error', (request, response) => {

        })

        const tickCounter = metrics.createCounter({
            help: 'Number of called interval',
            name: 'called_interval'
        })

        metrics.createGauge({
            help: 'Random value',
            name: 'random',
            collect() {
                this.set(Math.round(Math.random() * 10000))
            }
        })

        const httpInputHistogram = metrics.createHistogram({
            help: 'Input Http Requests',
            name: 'input_http',
            buckets: [40, 100, 500]
        })

        for await (const _ of setInterval(1000, undefined, { signal: abortSignal})) {
            const elapsedTime = Math.round(Math.random() * 750)
            tickCounter.inc()
            httpInputHistogram.observe(elapsedTime)
            //remoteEE.emit('tick', { elapsedTime })
        }