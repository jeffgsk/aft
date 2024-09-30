import * as cryptoJs from 'https://esm.run/crypto-js';

let target;
let content = new ArrayBuffer(0);
let warningbox;
let receivedFragments = {};
let totalChecksum = null;

function onReceive(recvPayload) {
    content = Quiet.mergeab(content, recvPayload);
    let fragmentText = Quiet.ab2str(content);
    console.log("Fragment text:", fragmentText);
    processMessages(fragmentText);
    warningbox.classList.add("hidden");
}

async function processMessages(fragmentText) {
    if (fragmentText.startsWith("F>>") && fragmentText.endsWith("<<F")) {
        let cleanMessage = fragmentText.substring("F>>".length, fragmentText.length - "<<F".length);
        let parts = cleanMessage.split('<~>');
        if (parts.length === 3) {
            let fragmentIndex = parts[0];
            let fragment = parts[1];
            let fragmentChecksum = parts[2];
            const computedChecksum = cryptoJs.default.MD5(fragment).toString();

            if (fragmentChecksum === computedChecksum) {
                receivedFragments[fragmentIndex] = fragment;
                console.log(`Received fragment ${fragmentIndex}:`, fragment);
            } else {
                console.log(`Checksum verification failed for fragment ${fragmentIndex}`);
            }
        } else {
            console.log("Invalid fragment format:", cleanMessage);
        }

    } else if (fragmentText.startsWith("E>>") && fragmentText.endsWith("<<E")) {
        totalChecksum = fragmentText.substring("E>>".length, fragmentText.length - "<<E".length);
        console.log("Received total checksum:", totalChecksum);
        await verifyReassembledMessage();
    } else if (fragmentText.startsWith("R>>") && fragmentText.endsWith("<<R")) {
        console.log("Ignoring receiver response on receiver side.");
    } else {
        console.log("Invalid message format:", fragmentText);
    }
}

async function verifyReassembledMessage() {
    let reassembledMessage = Object.keys(receivedFragments)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(key => receivedFragments[key])
        .join('');

    const computedTotalChecksum = cryptoJs.default.MD5(reassembledMessage).toString();

    if (computedTotalChecksum === totalChecksum) {
        console.log("Total message checksum verified successfully.");
        target.textContent = reassembledMessage;
        await sendResponseToSender(true, []); // All fragments received correctly
        receivedFragments = {}; // Clear fragments after successful assembly
    } else {
        console.log("Total message checksum verification failed.");
        const missingFragments = findMissingFragments();
        await sendResponseToSender(false, missingFragments); // Send missing fragments list
    }
}

function findMissingFragments() {
    const fragmentIndices = Object.keys(receivedFragments).map(Number);
    const maxIndex = Math.max(...fragmentIndices);
    let missingFragments = [];
    for (let i = 0; i <= maxIndex; i++) {
        if (!fragmentIndices.includes(i)) {
            missingFragments.push(i);
        }
    }
    return missingFragments;
}

async function sendResponseToSender(success, missingFragments) {
    const response = {
        success: success,
        missingFragments: missingFragments
    };
    const responseMessage = `R>>${JSON.stringify(response)}<<R`;

    console.log("Sending response to sender:", responseMessage);

    for (let i = 0; i < 3; i++) { // Send the response multiple times to ensure it's received
        await transmit.transmit(Quiet.str2ab(responseMessage));
        await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay between sends
    }
}

function onReceiverCreateFail(reason) {
    console.log("Failed to create Quiet receiver:", reason);
    warningbox.classList.remove("hidden");
    warningbox.textContent = "Sorry, it looks like this example is not supported by your browser. Please give permission to use the microphone or try again in Google Chrome or Microsoft Edge.";
}

function onReceiveFail(num_fails) {
    warningbox.classList.remove("hidden");
    warningbox.textContent = "We didn't quite get that. It looks like you tried to transmit something. You may need to move the transmitter closer to the receiver and set the volume to 50%.";
}

function onQuietReady() {
    return;
}

function startListen() {
    var profilename = 'audible';
    Quiet.receiver({
        profile: profilename,
        onReceive: onReceive,
        onCreateFail: onReceiverCreateFail,
        onReceiveFail: onReceiveFail
    });
}

function onQuietFail(reason) {
    console.log("Quiet failed to initialize:", reason);
    warningbox.classList.remove("hidden");
    warningbox.textContent = "Sorry, it looks like there was a problem with this example (" + reason + ")";
}

function onDOMLoad() {
    target = document.querySelector('[data-quiet-receive-text-target]');
    warningbox = document.querySelector('[data-quiet-warning]');
    Quiet.addReadyCallback(onQuietReady, onQuietFail);
}

document.addEventListener("DOMContentLoaded", onDOMLoad);

Quiet.init({
    profilesPrefix: "/",
    memoryInitializerPrefix: "/",
    libfecPrefix: "/"
});

export { startListen };