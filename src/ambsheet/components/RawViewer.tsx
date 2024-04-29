import { Value, resolvePositionsInContext } from '../eval';

export const RawViewer = ({ values }: { values: Value[] }) => {
  const valuesWithAmbNodePositions = values.map((value) => ({
    ...value,
    context: resolvePositionsInContext(value.context),
  }));
  console.log({ values, valuesWithAmbNodePositions });
  return (
    <pre className="text-xs">
      {JSON.stringify(valuesWithAmbNodePositions, null, 2)}
    </pre>
  );
};
