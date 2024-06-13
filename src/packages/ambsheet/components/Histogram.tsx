import { useMemo } from 'react';
import * as d3 from 'd3';
import { printRawValue } from '../print';

type HistogramProps = {
  width: number;
  height: number;
  data: number[];
  /** A subset of the data which will be shown as a blue overlay */
  filteredData: number[];
  selectValuesBetween: (arg: { min: number; max: number } | null) => void;
};

export const Histogram = ({
  width,
  height,
  data,
  filteredData,
  selectValuesBetween,
}: HistogramProps) => {
  const xScale = useMemo(() => {
    return d3
      .scaleLinear()
      .domain([Math.min(...data), Math.max(...data)])
      .range([10, width - 10]);
  }, [width, data]);

  const bucketGenerator = useMemo(() => {
    const minData = Math.min(...data);
    const maxData = Math.max(...data);
    // const numBuckets = Math.min(data.length, 15);
    const numBuckets = 15;
    const step = (maxData - minData) / numBuckets;
    const thresholds = Array.from(
      { length: numBuckets + 2 },
      (_, i) => minData + step * i
    );
    return d3
      .bin()
      .value((d) => d)
      .domain([minData, maxData])
      .thresholds(d3.range(minData, maxData, (maxData - minData) / numBuckets));
  }, [data]);

  const buckets = useMemo(() => {
    return bucketGenerator(data);
  }, [data, bucketGenerator]);

  const filteredBuckets = useMemo(() => {
    return bucketGenerator(filteredData);
  }, [filteredData, bucketGenerator]);

  const yScale = useMemo(() => {
    const max = Math.max(...buckets.map((bucket) => bucket?.length));
    return d3.scaleLinear().range([height, 0]).domain([0, max]); // Added 20px margin on top and bottom
  }, [buckets, height]);

  const allRects = buckets.map((bucket, i) => {
    if (
      bucket.x0 == undefined ||
      bucket.x1 == undefined ||
      bucket.length == 0
    ) {
      return null;
    }
    return (
      <rect
        key={i}
        className="fill-gray-400 hover:fill-blue-200"
        stroke="white"
        strokeWidth="2"
        x={xScale(bucket.x0)}
        width={xScale(bucket.x1) - xScale(bucket.x0)}
        y={yScale(bucket.length) - 12}
        height={height - yScale(bucket.length)}
        onMouseEnter={() =>
          selectValuesBetween({ min: bucket.x0, max: bucket.x1 })
        }
        onMouseLeave={() => selectValuesBetween(null)}
      />
    );
  });

  const filteredRects = filteredBuckets.map((bucket, i) => {
    if (
      bucket.x0 == undefined ||
      bucket.x1 == undefined ||
      bucket.length == 0
    ) {
      return null;
    }

    return (
      <rect
        key={i}
        className="fill-blue-200 pointer-events-none"
        stroke="white"
        strokeWidth="2"
        x={xScale(bucket.x0)}
        width={xScale(bucket.x1) - xScale(bucket.x0)}
        y={yScale(bucket.length) - 12}
        height={height - yScale(bucket.length)}
      />
    );
  });

  return (
    <svg width={width} height={height}>
      {allRects}
      {filteredRects}
      <text x={10} y={height - 2} className="text-xs fill-gray-500">
        {printRawValue(Math.min(...data))}
      </text>
      <text
        x={width - 10}
        y={height - 2}
        className="text-xs fill-gray-500"
        textAnchor="end"
      >
        {printRawValue(Math.max(...data))}
      </text>
    </svg>
  );
};
