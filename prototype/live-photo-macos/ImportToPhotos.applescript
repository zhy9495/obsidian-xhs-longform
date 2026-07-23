on run arguments
	if (count of arguments) is not 2 then error "用法：osascript ImportToPhotos.applescript <photo.jpg> <video.mov>"
	set photoPath to item 1 of arguments
	set videoPath to item 2 of arguments
	tell application "Photos"
		set importedItems to import {POSIX file photoPath, POSIX file videoPath} skip check duplicates yes
		return count of importedItems
	end tell
end run
