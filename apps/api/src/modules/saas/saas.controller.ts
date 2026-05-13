import {AppBindings} from "../../http/types.js";
import {getUserService} from "./saas.service.js";

export async function getUserController(c: import("hono").Context<AppBindings>) {
    // const authContext = c.get("authContext");

    // if (!authContext.userId) {
    //     throw new Error("Not authorized");
    // }

    const user = await getUserService();

    return c.json(user);
}