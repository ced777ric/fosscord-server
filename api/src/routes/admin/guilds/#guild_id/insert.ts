import { Request, Response, Router } from "express";
import { Guild, Member, PublicMemberProjection, User } from "@fosscord/util";
import { route } from "@fosscord/api";
import { MoreThan } from "typeorm";
import { HTTPError } from "lambert-server";

const router = Router();

// TODO: not allowed for user -> only allowed for bots with privileged intents
// TODO: send over websocket
// TODO: check for GUILD_MEMBERS intent

router.post("/", route({}), async (req: Request, res: Response) => {
	const { guild_id } = req.params;
	const { user_id } = req;
	const user = await User.findOneOrFail({ id: req.user_id });
	if(user.bot && user.system && (Number(user.rights) << Number(0))%Number(2)==Number(1)) {
		await Member.addToGuild(user_id, guild_id)
		res.sendStatus(204);
	}
	else {
		res.sendStatus(403);
	}
});

export default router;
