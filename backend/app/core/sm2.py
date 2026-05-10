"""
SM-2 Algorithm Implementation for LexiSync.

The SM-2 algorithm is a spaced repetition algorithm originally developed
for the SuperMemo software. It calculates optimal intervals for reviewing
items based on the learner's self-assessed quality of recall.

Quality scale (q):
    0 - Complete blackout, no recall
    1 - Incorrect response, but upon seeing the correct answer, felt familiar
    2 - Incorrect response, but the correct answer seemed easy to recall
    3 - Correct response with serious difficulty (hesitation > 10s)
    4 - Correct response after some hesitation (> 3s, < 10s)
    5 - Perfect response, immediate recall (< 3s)

Reference: https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
"""

from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass
class SM2Result:
    """Result of an SM-2 algorithm calculation."""

    interval: int
    easiness_factor: float
    repetitions: int
    next_review_at: datetime


def calculate_sm2(
    quality: int,
    previous_interval: int,
    previous_easiness_factor: float,
    previous_repetitions: int,
) -> SM2Result:
    """
    Calculate the next review interval using the SM-2 algorithm.

    Args:
        quality: Self-assessed quality of recall (0-5).
        previous_interval: Previous interval in days.
        previous_easiness_factor: Previous easiness factor (EF), minimum 1.3.
        previous_repetitions: Number of consecutive correct recalls.

    Returns:
        SM2Result containing the new interval, easiness factor,
        repetition count, and next review datetime.

    Raises:
        ValueError: If quality is not in range [0, 5].
    """
    if not 0 <= quality <= 5:
        raise ValueError(f"Quality must be between 0 and 5, got {quality}")
    if previous_easiness_factor < 1.3:
        previous_easiness_factor = 1.3

    ef = previous_easiness_factor
    interval = previous_interval
    reps = previous_repetitions

    if quality < 3:
        reps = 0
        interval = 1
    else:
        ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
        if ef < 1.3:
            ef = 1.3

        reps += 1

        if reps == 1:
            interval = 1
        elif reps == 2:
            interval = 6
        else:
            interval = round(previous_interval * ef)

    next_review_at = datetime.now() + timedelta(days=interval)

    return SM2Result(
        interval=interval,
        easiness_factor=round(ef, 2),
        repetitions=reps,
        next_review_at=next_review_at,
    )


def is_due_for_review(next_review_at: datetime) -> bool:
    """Check if a word record is due for review."""
    return datetime.now() >= next_review_at
