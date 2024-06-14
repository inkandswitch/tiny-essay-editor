import { DataType } from "@/os/datatypes";
import { EditorProps, useToolsForDataType } from "@/os/tools";
import { EditorPropsWithTool } from "@/os/versionControl/components/VersionControlEditor";
import React from "react";
import { useMemo } from "react";

type StatusBarProps = EditorProps<unknown, unknown> & {
  dataType: DataType<unknown, unknown, unknown>;
};

export const StatusBar = (props: StatusBarProps) => {
  const { dataType } = props;

  const tools = useToolsForDataType(dataType);
  const statusBarComponent = useMemo(
    () =>
      tools.flatMap(({ statusBarComponent }) =>
        statusBarComponent ? [statusBarComponent] : []
      ),

    [tools]
  );

  return (
    <div className="bg-gray-100 p-2 flex items-center border-t border-gray-200 gap-3">
      {statusBarComponent.map((component) =>
        React.createElement(component, props)
      )}
    </div>
  );
};
