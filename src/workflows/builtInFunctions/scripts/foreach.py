import argparse
import json
import os

from utils import get_file_list, execute, save_file

if __name__ == '__main__':

    parser = argparse.ArgumentParser(description='Executes a given function on each file within the folder')
    parser.add_argument('--input_folder', type=str, required=True,
                        help='path to the folder containing the files to loop over')
    parser.add_argument('--method_url', type=str, required=True,
                        help='url to the method to execute (same instance of DIVAServices)')
    parser.add_argument('--method_parameters', default=None, type=json.loads,
                        help='parameter arguments for the given method as json '
                             '(e.g. "{\"threshold\":0.000001,\"maxFeaturesPerScale\":-1,\"detector\":\"Harris\"}")')
    parser.add_argument('--collection_name', type=str, required=True,
                        help='name of the input collection')
    parser.add_argument('--output_folder', type=str, required=True,
                        help='path to the output folder')
    args = parser.parse_args()

    # get files in folder
    files = get_file_list(args.input_folder)

    # # parse url go the root url
    # parser = urlparse(args.method_url)
    # page_url = parser.scheme + '://' + parser.netloc
    #
    # # create output collection
    # payload_collection = "{\n\t\"files\": [\n\t\t\n\t]\n}"
    # collection_name = execute(page_url + "/collections", payload_collection)

    # execute method on files
    for file in files:
        # dont execute the method on the log file
        if 'logFile.text' in file:
            continue

        parameters = ''
        if args.method_parameters is not None:
            # done twice go get the escape in from of the quotes
            parameters = json.dumps(args.method_parameters).replace('"', '\"')

        payload_method = "{\n\t\"parameters\":" + parameters + "," \
                         "\n\t\"data\":[" \
                         "\n\t\t{\n\t\t\t\"inputImage\": \"" + args.collection_name + "/" + file + "\"" \
                         "\n\t\t}" \
                         "\n\t]\n}"

        # execute the method
        response = execute(args.method_url, payload_method)

        # get file basename (test.txt -> test)
        file_name, _ = os.path.splitext(file)

        # create new folder with input file name
        folder_path = os.path.join(args.output_folder, file_name + "_result")
        os.mkdir(folder_path)

        # loop over results and save them
        for i, result in enumerate(response['output']):
            result_link = result['file']['url']
            if 'logFile.txt' not in result_link:
                save_file(result_link, folder_path)
