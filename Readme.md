Audio Base File transfer library

The purpose of this library is to provide a simple and efficient way to transfer text files between devices. 

The Sender sender first retrieves a list of local files from a local api call (sender-server.js).  Next, it retrieves the content of each file and transmits it to the receiver using the Quiet library.  It sends the content in segments, with each segment containing a fragment index, the actual fragment content and a checksum.  The receiver takes these segments and reassembles the original content.

If there is a transmission error, the receiver will request the missing fragments from the sender.  The sender will then re-send the missing fragments.

Once the receiver has received all the fragments, it will reassemble the original content and save it to a file.  The receiver will notify the sender that the transmission is complete.   The sender will then proceed to the next file.
