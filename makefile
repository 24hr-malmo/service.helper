# use .PHONY since we have a directory test
# http://stackoverflow.com/questions/2145590/what-is-the-purpose-of-phony-in-a-makefile
.PHONY: test
test:
	mocha test
