"""Waste streams are independent of existing/proposed point provenance."""
from typing import Literal

WasteType = Literal["general", "recycling"]
HistoryWasteType = Literal["general", "recycling", "legacy_unknown"]
WASTE_TYPES = ("general", "recycling")
CLASSIFICATION_SOURCE = "demo_assumption"
