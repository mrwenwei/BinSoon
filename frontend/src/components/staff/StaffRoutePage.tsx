// Historical prototype adapter. Production routing reads /staff/route-stops.
import { CrewRoutePlanner } from "../CrewRoutePlanner";
import { demoOrigin } from "../../data/binDemo";
import { type CrewVehicle } from "../../data/crewRouting";
import { type LocationRecord } from "../../data/locations";
import { type WorkOrder } from "../../data/workOrders";
import { reportTypes } from "../../data/reports";
import { useDemoStore } from "../../data/demoStore";
export function StaffRoutePage({
  bins,
  tasks,
  vehicle,
  onVehicleChange,
}: {
  bins: LocationRecord[];
  tasks: WorkOrder[];
  vehicle: CrewVehicle;
  onVehicleChange: (value: CrewVehicle) => void;
}) {
  const { state } = useDemoStore();
  return (
    <CrewRoutePlanner
      bins={bins}
      tasks={tasks.map((task) => ({
        id: task.id,
        locationId: task.locationId,
        label:
          reportTypes.find((type) => type.id === task.type)?.label || task.type,
      }))}
      vehicle={vehicle}
      onVehicleChange={onVehicleChange}
      origin={demoOrigin}
      operations={state}
    />
  );
}
