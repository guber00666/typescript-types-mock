import { ExternalResponse, Status } from "fake-package";
import { Config, Logger } from "@my-org/types";

interface MyData {
  response: ExternalResponse;
  status: Status;
  localField: string;
  config: Config;
  logger: Logger;
}