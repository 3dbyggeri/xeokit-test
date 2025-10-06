/**
 * Test script to simulate sending Pusher messages for Glasshouse Link testing
 * This simulates what the Revit plugin would send
 */

const Pusher = require('pusher');

// Pusher configuration (same as in the Revit plugin)
const pusher = new Pusher({
    appId: '1111111', // dummy app id
    key: '58585858585858585858', // dummy key
    secret: '38383838383838383838', // dummy secret
    cluster: 'eu', // dummy cluster
    useTLS: true
});

/**
 * Send a SelectEntries event to a channel
 * @param {string} channelName - The Pusher channel name
 * @param {string[]} guids - Array of GUIDs to select
 */
async function sendSelectEntries(channelName, guids) {
    try {
        const eventData = {
            guids: guids
        };

        await pusher.trigger(channelName, 'SelectEntries', {
            data: JSON.stringify(eventData)
        });

        console.log(`✅ Sent SelectEntries to channel "${channelName}" with GUIDs:`, guids);
    } catch (error) {
        console.error('❌ Error sending SelectEntries:', error.message);
    }
}

/**
 * Send an IsolateEntries event to a channel
 * @param {string} channelName - The Pusher channel name
 * @param {string[]} guids - Array of GUIDs to isolate
 */
async function sendIsolateEntries(channelName, guids) {
    try {
        const eventData = {
            guids: guids
        };

        await pusher.trigger(channelName, 'IsolateEntries', {
            data: JSON.stringify(eventData)
        });

        console.log(`✅ Sent IsolateEntries to channel "${channelName}" with GUIDs:`, guids);
    } catch (error) {
        console.error('❌ Error sending IsolateEntries:', error.message);
    }
}

/**
 * Test function to send sample messages
 */
async function runTests() {
    console.log('🚀 Starting Pusher message tests...\n');

    // Example channel name (this would come from the user's Glasshouse account)
    const testChannelName = '5f6a2060-bc9f-0139-a138-021d4942cc59';

    // Example GUIDs (these would be actual object GUIDs from Revit)
    const sampleGuids = [
        '1b073872-1611-4975-8bcb-789e522b108d-00030094',
        '1b073872-1611-4975-8bcb-789e522b108d-00030093',
        '1b073872-1611-4975-8bcb-789e522b108d-000302ea'
    ];

    console.log(`📡 Using channel: ${testChannelName}`);
    console.log(`🎯 Using sample GUIDs: ${sampleGuids.join(', ')}\n`);

    // Test SelectEntries
    console.log('1️⃣ Testing SelectEntries event...');
    await sendSelectEntries(testChannelName, sampleGuids);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test IsolateEntries
    console.log('\n2️⃣ Testing IsolateEntries event...');
    await sendIsolateEntries(testChannelName, sampleGuids.slice(0, 2)); // Only first 2 GUIDs

    console.log('\n✨ Tests completed!');
    console.log('\n📋 To test with the web application:');
    console.log('1. Open http://localhost:8080 in your browser');
    console.log('2. Click the Glasshouse Link button (chain icon)');
    console.log('3. Use test credentials and set the channel name to:', testChannelName);
    console.log('4. Run this script again to send test messages');
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        runTests();
    } else if (args[0] === 'select') {
        const channelName = args[1] || 'test-channel-123';
        const guids = args.slice(2);
        if (guids.length === 0) {
            console.log('Usage: node test-pusher-sender.js select <channel> <guid1> [guid2] ...');
            process.exit(1);
        }
        sendSelectEntries(channelName, guids);
    } else if (args[0] === 'isolate') {
        const channelName = args[1] || 'test-channel-123';
        const guids = args.slice(2);
        if (guids.length === 0) {
            console.log('Usage: node test-pusher-sender.js isolate <channel> <guid1> [guid2] ...');
            process.exit(1);
        }
        sendIsolateEntries(channelName, guids);
    } else {
        console.log('Usage:');
        console.log('  node test-pusher-sender.js                    # Run full test');
        console.log('  node test-pusher-sender.js select <channel> <guid1> [guid2] ...');
        console.log('  node test-pusher-sender.js isolate <channel> <guid1> [guid2] ...');
    }
}

module.exports = {
    sendSelectEntries,
    sendIsolateEntries
};
