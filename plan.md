To Make file is cleaner at layout/Profile, temporarily NO consider class name, and focus on functions and UI in Profile folder
- Structure is OK, but I think the Names file is not explicit to help other developer understand, and it's similar situation in case variable/function name inside their file
- During observing I see some functions which should be in helper folder.
- Some of interface, for example, Comment, User interface in Admin DashBoardPanel.tsx should be in types/types.ts, and you should avoid keeping request<any>, any should be change any to an interface from types.ts. NOTE: You must change the api function at frontend realated to functions in these file in Profile Folder
- ModerationPanel.tsx I have not handled preview, but for Comic preview you can use modal which show the information and UI/structure like update Upload Comic in ComicSuggestionPanel.tsx and for chapter preview you can use modal which show the information and UI like update Upload chapter in ComicSuggestionPanel.tsx. 
- in 'useg' class name, accept/pending/reject should have number on the left which is similar to ModerationPanel's accept/pending/reject at the moment
- We use upagination which has css like ModerationPanel.tsx, no longer using component/Pagination.tsx for all file in Profile folder
