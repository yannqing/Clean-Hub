import {Hono} from "hono";
import {getUserController} from "./saas.controller.js";
import {AppBindings} from "../../../http/types.js";

export function createSaaSTestRoutes() {
    const routes = new Hono<AppBindings>();

    routes.get("/", getUserController);
    return routes;
}