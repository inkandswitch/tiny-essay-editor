import { Value, resolvePositionsInContext } from '../eval';

export const RawViewer = ({ values }: { values: Value[] }) => {
  const valuesWithAmbNodePositions = values.map((value) => ({
    ...value,
    context: resolvePositionsInContext(value.context),
  }));
  return (
    <pre className="text-xs overflow-auto max-h-[300px] border border-gray-300">
      {JSON.stringify(valuesWithAmbNodePositions, null, 2)}
    </pre>
  );
};
