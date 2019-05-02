import argparse
import os
import re
from shutil import copyfile

from utils import get_file_list

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Picks A file defined by a regex from a given folder.'
                                                 ' If there are multiple matches it takes the first one')
    parser.add_argument("--input_folder", required=True, type=str,
                        help="Folder from which we pick the file.")
    parser.add_argument("--regex", required=True, type=str,
                        help="Regular expression to find the file in the folder. (e.g. .txt)")
    parser.add_argument("--output_folder", required=True, type=str,
                        help="Path to the output folder.")
    args = parser.parse_args()

    # find FIRST file name containing the regex
    files = get_file_list(args.input_folder)

    # escape the characters
    regex = re.escape(args.regex)

    # save it into the output folder
    for file in files:
        if re.search(regex, file) is not None:
            _, file_extension = os.path.splitext(file)
            copyfile(os.path.join(args.input_folder, file), os.path.join(args.output_folder, "outputFile" + file_extension))
            os._exit(0)

    print("No results found for regex: " + regex)
    print("Files in input folder " + str(files))
