import {type Database, getDb} from "@cleanhub/db";
import {getUsers} from "./saas.repository.js";

export async function getUserService(db: Database = getDb()) {
    return getUsers(db, 'f600274e-0566-4b04-8c28-16002788c9da');
}