// Historical prototype harness only. The API entry imports LocationMap directly.
import { useDemoStore } from "../data/demoStore";
import { LocationMap } from "./LocationMap";
import type { ComponentProps } from "react";
export function DemoLocationMap(props: ComponentProps<typeof LocationMap>) {
  const { state } = useDemoStore();
  return <LocationMap {...props} operations={state} />;
}
