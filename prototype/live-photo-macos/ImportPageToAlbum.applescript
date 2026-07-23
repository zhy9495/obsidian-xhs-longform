on run arguments
	if (count of arguments) is less than 3 then error "缺少照片导入参数"
	set albumName to item 1 of arguments
	set resourceKind to item 2 of arguments
	set photoPath to item 3 of arguments
	tell application "Photos"
		set matchingAlbums to every album whose name is albumName
		if (count of matchingAlbums) is 0 then
			set targetAlbum to make new album named albumName
		else
			set targetAlbum to item 1 of matchingAlbums
		end if
		if resourceKind is "live-photo" then
			if (count of arguments) is not 4 then error "缺少实况视频资源"
			set videoPath to item 4 of arguments
			set importedItems to import {POSIX file photoPath, POSIX file videoPath} skip check duplicates yes
		else
			set importedItems to import {POSIX file photoPath} skip check duplicates yes
		end if
		add importedItems to targetAlbum
		return count of importedItems
	end tell
end run
