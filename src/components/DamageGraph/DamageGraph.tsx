import React, { useEffect, useRef, useId } from 'react';

interface DamageGraphProps {
  points: { x: number; y: number }[];
}

const DamageGraph: React.FC<DamageGraphProps> = ({ points }) => {
  const divRef = useRef<HTMLDivElement | null>(null);
  const containerId = `damage-graph-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return;

    let sciChartSurface: any;

    async function initSciChart() {
      try {
        const { SciChartSurface, NumericAxis, FastLineRenderableSeries, XyDataSeries, ZoomExtentsModifier, ZoomPanModifier, CursorModifier } = await import('scichart');

        SciChartSurface.setRuntimeLicenseKey(process.env.REACT_APP_SCICHART_LICENSE_KEY || '');

        // Use CDN for WebAssembly files to avoid development server routing issues
        // eslint-disable-next-line react-hooks/rules-of-hooks
        SciChartSurface.useWasmFromCDN();

        // Ensure div exists and has proper ID
        if (divRef.current && divRef.current.id) {
          const { sciChartSurface: surface, wasmContext } = await SciChartSurface.create(divRef.current.id);

          sciChartSurface = surface;

          sciChartSurface.xAxes.add(new NumericAxis(wasmContext));
          sciChartSurface.yAxes.add(new NumericAxis(wasmContext));

          const ds = new XyDataSeries(wasmContext);
          points.forEach(p => ds.append(p.x, p.y));

          const series = new FastLineRenderableSeries(wasmContext, { dataSeries: ds, stroke: '#3FC4FF', strokeThickness: 2 });
          sciChartSurface.renderableSeries.add(series);

          sciChartSurface.chartModifiers.add(new ZoomExtentsModifier(), new ZoomPanModifier(), new CursorModifier());
        } else {
          throw new Error('Chart container div not found or missing ID');
        }
      } catch (e) {
        console.error("SciChart initialization error: ", e);
        if (divRef.current) {
          divRef.current.innerText = 'SciChart failed to load. Check console for details.';
        }
      }
    }

    const timeoutId = setTimeout(initSciChart, 100); // Slightly longer delay to ensure DOM is ready

    return () => {
      clearTimeout(timeoutId);
      if (sciChartSurface) {
        sciChartSurface.delete();
      }
    };
  }, [points, containerId]);

  return <div id={containerId} ref={divRef} style={{ width: '100%', height: 200, background: '#1a1a1a', border: '1px solid #333', borderRadius: 4 }} />;
};

export default DamageGraph;
