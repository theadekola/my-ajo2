DECLARE @IconMap TABLE (OldIcon NVARCHAR(10), NewIcon NVARCHAR(40));

INSERT INTO @IconMap (OldIcon, NewIcon) VALUES
  (NCHAR(55356)+NCHAR(57304), N'home'),       -- U+1F3D8
  (NCHAR(55356)+NCHAR(57312), N'home'),       -- U+1F3E0
  (NCHAR(11041), N'groups'),                  -- U+2B21
  (NCHAR(55357)+NCHAR(56421), N'users'),      -- U+1F465
  (NCHAR(55357)+NCHAR(56496), N'money'),      -- U+1F4B0
  (NCHAR(55357)+NCHAR(56504), N'money'),      -- U+1F4B8
  (NCHAR(55356)+NCHAR(57318), N'bank'),       -- U+1F3E6
  (NCHAR(55357)+NCHAR(56563), N'card'),       -- U+1F4B3
  (NCHAR(55357)+NCHAR(56523), N'clipboard'),  -- U+1F4CB
  (NCHAR(55357)+NCHAR(56517), N'calendar'),   -- U+1F4C5
  (NCHAR(55357)+NCHAR(56492), N'message'),    -- U+1F4AC
  (NCHAR(55357)+NCHAR(56522), N'chart'),      -- U+1F4CA
  (NCHAR(55357)+NCHAR(56596), N'bell'),       -- U+1F514
  (NCHAR(9881)+NCHAR(65039), N'settings'),    -- U+2699 U+FE0F
  (NCHAR(9881), N'settings'),                 -- U+2699
  (NCHAR(55357)+NCHAR(56420), N'user'),       -- U+1F464
  (NCHAR(55357)+NCHAR(56534), N'book'),       -- U+1F4D6
  (NCHAR(9993)+NCHAR(65039), N'mail'),        -- U+2709 U+FE0F
  (NCHAR(9878)+NCHAR(65039), N'scale'),       -- U+2696 U+FE0F
  (NCHAR(55357)+NCHAR(56594), N'lock'),       -- U+1F512
  (NCHAR(10067), N'help'),                    -- U+2753
  (NCHAR(55357)+NCHAR(56562), N'phone'),      -- U+1F4F2
  (NCHAR(55356)+NCHAR(57101), N'globe'),      -- U+1F30D
  (NCHAR(55357)+NCHAR(56960), N'rocket'),     -- U+1F680
  (NCHAR(55357)+NCHAR(56599), N'link'),       -- U+1F517
  (NCHAR(55357)+NCHAR(56592), N'shield'),     -- U+1F510
  (NCHAR(55357)+NCHAR(56508), N'briefcase'),  -- U+1F4BC
  (NCHAR(55356)+NCHAR(57235), N'book');       -- U+1F393

UPDATE g
SET Icon = m.NewIcon
FROM dbo.AjoGroups g
JOIN @IconMap m ON g.Icon = m.OldIcon;

SELECT GroupId, GroupName, Icon FROM dbo.AjoGroups ORDER BY GroupId;