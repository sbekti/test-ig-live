/* tslint:disable:no-console */
const { IgApiClient, LiveEntity, IgLoginTwoFactorRequiredError, IgCheckpointError } = require('instagram-private-api');
const Bluebird = require('bluebird');
const inquirer = require('inquirer');
const { sample } = require('lodash');
const serverline = require('serverline');

serverline.init()
serverline.setPrompt('> ')

const ig = new IgApiClient();

ig.state.generateDevice('hhaa');

(async () => {
  // Execute all requests prior to authorization in the real Android application
  // Not required but recommended
  await ig.simulate.preLoginFlow();
  const loggedInUser = await ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD);
  // The same as preLoginFlow()
  // Optionally wrap it to process.nextTick so we dont need to wait ending of this bunch of requests
  process.nextTick(async () => await ig.simulate.postLoginFlow());

  const { broadcast_id, upload_url } = await ig.live.create(loggedInUser.pk, {
    // create a stream in 720x1280 (9:16)
    previewWidth: 720,
    previewHeight: 1280,
    // this message is not necessary, because it doesn't show up in the notification
    message: 'My message',
  });

  const { stream_key, stream_url } = LiveEntity.getUrlAndKey({ broadcast_id, upload_url });
  console.log(`Start your stream on ${stream_url}.\n
    Your key is: ${stream_key}`);

  // process.stdin.resume();
  // process.on('SIGINT', exitHandler.bind(null, { broadcast_id: broadcast_id }));

  /**
   * make sure you are streaming to the url
   * the next step will send a notification / start your stream for everyone to see
   */
  const startInfo = await ig.live.start(broadcast_id, false);
  // status should be 'ok'
  console.log(startInfo);

  // initial comment-timestamp = 0, get all comments
  let lastCommentTs = await printComments(broadcast_id, 0);

  // enable the comments
  await ig.live.unmuteComment(broadcast_id);
  /**
   * wait 2 seconds until the next request.
   * in the real world you'd use something like setInterval() instead of Bluebird.delay() / just to simulate a delay
   */

   serverline.on('line', function(line) {
     ig.live.comment(broadcast_id, line);
   })

   serverline.on('SIGINT', function(rl) {
     exitHandler({broadcast_id:broadcast_id})
     // serverline.question('Confirm exit: ', (answer) => answer.match(/^y(es)?$/i) ? process.exit(0) : serverline.output.write('\x1B[1K> '))
   })

   while (true) {
     // now, we print the next comments
     lastCommentTs = await printComments(broadcast_id, lastCommentTs);
     await Bluebird.delay(2000);
   }

  // // now we're commenting on our stream
  // await ig.live.comment(broadcast_id, 'Test Instagram API');
})();

async function printComments(broadcastId, lastCommentTs) {
  const { comments } = await ig.live.getComment({ broadcastId, lastCommentTs });
  if (comments.length > 0) {
    comments.forEach(comment => console.log(`${comment.user.username}: ${comment.text}`));
    return comments[comments.length - 1].created_at;
  } else {
    return lastCommentTs;
  }
}

async function printViewers(broadcastId) {
  const { users } = await ig.live.getViewerList(broadcastId);
  if (users.length > 0) {
    users.forEach(user => console.log(`${user.username}`));
    console.log(`--- Viewers: ${viewers.length} ---`)
  }
}

async function exitHandler(options, exitCode) {
    console.log("Ending broadcast...")
    await ig.live.endBroadcast(options.broadcast_id);

    console.log("Posting broadcast...")
    await ig.live.addToPostLive(options.broadcast_id);

    console.log("Exiting...")
    process.exit(0)
}

// async function login() {
//   // Initiate Instagram API client
//   const ig = new IgApiClient();
//   ig.state.generateDevice('1234');
//   ig.state.proxyUrl = process.env.IG_PROXY;
//
//   await ig.simulate.preLoginFlow();
//
//   // Perform usual login
//   // If 2FA is enabled, IgLoginTwoFactorRequiredError will be thrown
//   return Bluebird.try(() => ig.account.login(process.env.IG_USERNAME, process.env.IG_PASSWORD)).catch(
//     IgLoginTwoFactorRequiredError,
//     async err => {
//       console.log(err.response.body)
//       const {username, totp_two_factor_on, two_factor_identifier} = err.response.body.two_factor_info;
//       // decide which method to use
//       const verificationMethod = totp_two_factor_on ? '0' : '1'; // default to 1 for SMS
//       // At this point a code should have been sent
//       // Get the code
//       const { code } = await inquirer.prompt([
//         {
//           type: 'input',
//           name: 'code',
//           message: `Enter code received via ${verificationMethod === '1' ? 'SMS' : 'TOTP'}`,
//         },
//       ]);
//       // Use the code to finish the login process
//       return ig.account.twoFactorLogin({
//         username,
//         verificationCode: code,
//         twoFactorIdentifier: two_factor_identifier,
//         verificationMethod, // '1' = SMS (default), '0' = TOTP (google auth for example)
//         trustThisDevice: '1', // Can be omitted as '1' is used by default
//       });
//     },
//   ).catch(e => console.error('An error occurred while processing two factor auth', e, e.stack));
// }
//
// (async () => {
//   // basic login-procedure
//   const auth = await login();
//   process.nextTick(async () => await ig.simulate.postLoginFlow());
//   console.log(auth)
//
//   const { broadcast_id, upload_url } = await ig.live.create({
//     // create a stream in 720x1280 (9:16)
//     previewWidth: 720,
//     previewHeight: 1280,
//     // this message is not necessary, because it doesn't show up in the notification
//     message: 'My message',
//   });
//   // (optional) get the key and url for programs such as OBS
//   const { stream_key, stream_url } = LiveEntity.getUrlAndKey({ broadcast_id, upload_url });
//   console.log(`Start your stream on ${stream_url}.\n
//     Your key is: ${stream_key}`);
//
//   /**
//    * make sure you are streaming to the url
//    * the next step will send a notification / start your stream for everyone to see
//    */
//   const startInfo = await ig.live.start(broadcast_id);
//   // status should be 'ok'
//   console.log(startInfo);
//
//   /**
//    * now, your stream is running
//    * the next step is to get comments
//    * note: comments can only be requested roughly every 2s
//    */
//
//     // initial comment-timestamp = 0, get all comments
//   let lastCommentTs = await printComments(broadcast_id, 0);
//
//   // enable the comments
//   await ig.live.unmuteComment(broadcast_id);
//   /**
//    * wait 2 seconds until the next request.
//    * in the real world you'd use something like setInterval() instead of Bluebird.delay() / just to simulate a delay
//    */
//   // wait 2s
//   await Bluebird.delay(2000);
//   // now, we print the next comments
//   lastCommentTs = await printComments(broadcast_id, lastCommentTs);
//
//   // now we're commenting on our stream
//   await ig.live.comment(broadcast_id, 'A comment');
//
//   /**
//    * now, your stream is running, you entertain your followers, but you're tired and
//    * we're going to stop the stream
//    */
//   await ig.live.endBroadcast(broadcast_id);
//
//   // now you're basically done
// })();
//
