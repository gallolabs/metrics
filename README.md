<p align="center">
    <img height="200" src="https://raw.githubusercontent.com/gallolabs/open-metrics/main/logo_w200.jpeg">
  <p align="center"><strong>Gallolabs Open Metrics</strong></p>
</p>

An Open Metrics component (based on prom-client)

```typescript
    // Create a registry
    const metricsRegistry = new MetricsRegistry
    // Create a friendly component to deal with
    const metrics = new MetricsUserFriendlyInterface(metricsRegistry)
    // Create a Server
    const metricsServer = new MetricsServer({
        // And a formatter
        formatter: new MetricsFormatter,
        registry: metricsRegistry
    })
    await metricsServer.start(abortController.signal)

    const tickCounter = metrics.createCounter({
        help: 'Number of called ticks',
        name: 'called_count'
    })

    tickCounter.inc()
```

```bash
    curl http://localhost:9090/metrics
```

```text
# HELP called_count Number of called ticks
# TYPE called_count counter
called_count_total 1
# EOF
```

voilàà
