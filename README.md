<p align="center">
    <img height="200" src="https://raw.githubusercontent.com/gallolabs/metrics/main/logo_w200.jpeg">
  <p align="center"><strong>Gallolabs Metrics</strong></p>
</p>

A Metrics component, unified frontend and plugable backend (pull/push, StatsD/Prometheus/...)

## In your app, don't care about push/pull

```typescript

function doTheJob(metricBuilder) {
    const counter = metricBuilder.createCounter({
        name: 'callpartner.success',
        description: 'Job total success',
        tags: {partner: 'babeloka'}
    })

    counter.increment()
}
```

## In your app configuration, configure your handler

```typescript

const metricBuilder = new MetricsBuilder({handler: new StatsDHandler})

// Previous counter will send to StatsD "callpartner.success:1|c|#partner:babeloka"

const metricBuilder = new MetricsBuilder({handler: new OpenMetricsHandler})

/* Previous counter will display when calling http://localhost:9090/metrics
 *
 * # HELP callpartner_success Job total success
 * # TYPE callpartner_success counter
 * callpartner_success{partner="babeloka"} 1
 *
 */

```

## Collect feature

```typescript

function doTheJob(metricBuilder) {
    metricBuilder.createGauge({
        name: 'cpu',
        description: 'CPU used',
        onCollect(gauge) {
            gauge.set(os.getCpuUsage())
        }
    })
}
```

onCollect function will be called with pull handler where pulled, and periodically for push handler. In both case, for example, every 10 seconds.

## Scope feature

```typescript

function callPartner(metricBuilder) {
    metricBuilder.createCounter({
        name: 'success',
        description: 'Partner calls'
    }).increment()
}

callPartner(metricBuilder.child('callpartner', {partner: 'babeloka'}))
```

metricBuilder can be scoped in namespaced metric name and tags. Here callpartner.success with tag {partner = babeloka} will be resolved.

## But ...

This is just a POC ! A lot of things are to be done (errors handling, etc)
