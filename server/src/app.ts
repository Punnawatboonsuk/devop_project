import express from "express";
import ticketRoute from "./modules/ticket/ticket.route";
import dashboardRoute from "./modules/dashboard/dashboard.route";
import voteRoute from "./modules/vote/vote.route";

const app = express();

app.use(express.json());

app.use("/api/tickets", ticketRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/votes", voteRoute);

export default app;
