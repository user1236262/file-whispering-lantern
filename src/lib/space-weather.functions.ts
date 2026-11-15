import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getSpaceWeatherReport } from "./space-weather.server";

// Public read-only endpoint: fixed NASA feeds, fixed ranges, cached server-side.
// The NASA key is read here on the server and never sent to the browser.
export const getRealSpaceWeather = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ days: z.union([z.literal(7), z.literal(30)]) }).parse(input),
  )
  .handler(async ({ data }) => getSpaceWeatherReport(data.days, process.env["NASA_API_SK"]));
