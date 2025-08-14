/* Server Files Management Commands
*
* Instructions:
* - Important: Obtain a GitHub "personal access token" with the "gist" permission.
* - Set this token as the environment variable `GITHUB_TOKEN` on your server.
* - (Directly adding the token to the code is strongly discouraged for security).
*
* Credits: HoeenHero (Original HasteBin Code)
* Updates & Typescript Conversion: Prince Sky
*/

import { FS } from '../lib/fs';

const GITHUB_API_URL = 'https://api.github.com/gists';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const WHITELISTED_USERS = new Set(['princesky', 'musaddiktemkar']);
const REQUIRED_ROOM = ['development', 'staff'];

interface GistResponse {
	id: string;
	html_url: string;
}

/**
 * Shows an "unrecognized command" error to the user.
 * This prevents leaking the existence of restricted commands.
 */
function showUnrecognizedCommandError(context: CommandContext, command: string) {
	const { cmdToken } = context;
	if (cmdToken === '!') {
		return context.errorReply(`The command '!${command}' was unrecognized.`);
	}
	return context.errorReply(
		`The command '${command}' was unrecognized. To send a message starting with '${command}', type '${cmdToken}${command}'.`
	);
}

/**
 * Checks if a user is authorized to use these commands.
 * @returns {boolean} True if the user is allowed, otherwise false.
 */
function isAllowed(user: User, room: Room | null, context: CommandContext): boolean {
	if (room?.roomid !== REQUIRED_ROOM) {
		showUnrecognizedCommandError(context, context.cmd);
		return false;
	}
	if (!user.hasConsoleAccess(user.connections[0]) || !WHITELISTED_USERS.has(user.id)) {
		showUnrecognizedCommandError(context, context.cmd);
		return false;
	}
	return true;
}

Impulse.isAllowed = isAllowed;

/**
 * Uploads file content to a private GitHub Gist.
 * IMPROVEMENT: Uses the modern `fetch` API for cleaner async/await syntax.
 *
 * @param content The string content of the file to upload.
 * @param originalPath The original file path, used to determine the filename.
 * @param description A description for the Gist.
 * @returns The URL of the created Gist.
 */
async function uploadToGist(content: string, originalPath: string, description = 'Uploaded via bot'): Promise<string> {
	if (!GITHUB_TOKEN) {
		throw new Error('GitHub token not found. Please set the GITHUB_TOKEN environment variable.');
	}

	const parts = originalPath.split('/');
	const filename = parts[parts.length - 1];

	const body = JSON.stringify({
		description,
		public: false,
		files: {
			[filename]: { content },
		},
	});

	const response = await fetch(GITHUB_API_URL, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${GITHUB_TOKEN}`,
			'Accept': 'application/vnd.github.v3+json',
			'Content-Type': 'application/json',
			'User-Agent': 'Node-File-Uploader',
		},
		body,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
	}

	const gist: GistResponse = await response.json();
	return gist.html_url;
}

export const commands: Chat.ChatCommands = {
	file: 'getfile',
	fileretrieval: 'getfile',
	retrievefile: 'getfile',
	async getfile(this: CommandContext, target, room, user) {
		if (!isAllowed(user, room, this) || !this.runBroadcast()) return;

		const filePath = target.trim();
		if (!filePath) return this.parse('/help getfile');

		if (!GITHUB_TOKEN) {
			return this.errorReply("The GitHub token is not configured on the server.");
		}

		try {
			const fileContent = await FS(filePath).read();
			const gistUrl = await uploadToGist(fileContent, filePath, `File: ${filePath} uploaded by ${user.id}`);
			this.sendReplyBox(`File: <a href="${gistUrl}">${gistUrl}</a>`);
		} catch (error: any) {
			this.errorReply(`Error processing file '${filePath}': ${error.message}`);
		}
	},
	getfilehelp: [
		'/getfile <file name>: Uploads a server file to a private GitHub Gist.',
		'Example: /getfile config/config.js',
		'Note: Requires the GITHUB_TOKEN environment variable to be set.',
	],

	forcewritefile: 'writefile',
	async writefile(this: CommandContext, target, room, user, connection, cmd) {
		if (!isAllowed(user, room, this) || !this.runBroadcast()) return;

		const [gistUrl, targetPath] = target.split(',').map(part => part.trim());

		if (!gistUrl || !targetPath) {
			return this.parse('/help writefile');
		}
		if (!gistUrl.startsWith('https://gist.githubusercontent.com/')) {
			return this.errorReply(`Link must be a raw Gist URL (starting with https://gist.githubusercontent.com/).`);
		}
        
		try {
			FS(targetPath).readSync();
		} catch (e) {
			if (cmd !== 'forcewritefile') {
				return this.errorReply(`The file "${targetPath}" does not exist. Use /forcewritefile to create it.`);
			}
		}

		try {
			const response = await fetch(gistUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch Gist content: ${response.status} ${response.statusText}`);
			}
			const content = await response.text();
			await FS(targetPath).write(content);
			this.sendReplyBox(`Successfully wrote content to <code>${targetPath}</code>.`);
		} catch (error: any) {
			this.errorReply(`An error occurred: ${error.message}`);
		}
	},
	writefilehelp: [
		`/writefile <raw gist url>, <path to file>: Writes content from a Gist to a server file.`,
		`Example: /writefile https://gist.githubusercontent.com/.../raw/.../config.js, config/config.js`,
		`/forcewritefile <raw gist url>, <path to file>: Creates the file if it does not exist.`,
	],
};
