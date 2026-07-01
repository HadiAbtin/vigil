from pydantic import BaseModel


class MetricSeries(BaseModel):
    name: str
    # [unix_timestamp_seconds, value] pairs, chronological.
    points: list[list[float]]


class MetricRangeResponse(BaseModel):
    unit: str
    series: list[MetricSeries]
