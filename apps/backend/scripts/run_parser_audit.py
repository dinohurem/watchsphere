"""Run the parser audit READ-ONLY against a database and print the counts and examples.

Nothing is stored and no email is sent. The database comes from the environment:

    MONGODB_URL=... MONGODB_DB_NAME=... python scripts/run_parser_audit.py [--hours 24] [--examples 5]
"""
import argparse
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


async def main(hours: float, examples: int) -> None:
    from motor.motor_asyncio import AsyncIOMotorClient
    from beanie import init_beanie

    from app.models.order import Order
    from app.services import parser_audit

    url, name = os.environ.get("MONGODB_URL"), os.environ.get("MONGODB_DB_NAME")
    if not url or not name:
        sys.exit("Set MONGODB_URL and MONGODB_DB_NAME")
    client = AsyncIOMotorClient(url)
    await init_beanie(database=client[name], document_models=[Order])  # no writes: only binds the collection
    result = await parser_audit.run_audit(hours)
    print(f"{result['checked']} offers checked (created/updated since {result['since']:%Y-%m-%d %H:%M} UTC), "
          f"{result['total_findings']} findings")
    for code in parser_audit.CODES:
        n = result["counts"].get(code)
        if not n:
            continue
        print(f"\n{code}: {n}")
        for ex in result["examples"][code][:examples]:
            print(f"  {ex['order_id']} | {ex['ws_code']} | {ex['dealer']} | {ex['line']!r}")
            print(f"      price={ex['price']} {ex['currency']} year={ex['year']} month={ex['month']} -> {ex['why']}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=24)
    ap.add_argument("--examples", type=int, default=5)
    args = ap.parse_args()
    asyncio.run(main(args.hours, args.examples))
