import React, { useMemo } from 'react';
import { Value } from '../eval';
import { groupBy } from 'lodash';

export const RawViewer = ({ values }: { values: Value[] }) => {
  return <pre className="text-xs">{JSON.stringify(values, null, 2)}</pre>;
};
