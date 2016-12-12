"use strict";
/**
 * Created by lunactic on 07.11.16.
 */


import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";

export class RandomWordGenerator {

    static rootDir = path.resolve(__dirname, "../../", "words");
    /**
     * a list of ajdectives
     * 
     * @static
     * 
     * @memberOf RandomWordGenerator
     */
    static adjectives = fs.readFileSync(RandomWordGenerator.rootDir + "/adjectives", "utf8").toString().split("\n");
    
    /**
     * a list of animal names
     * 
     * @static
     * 
     * @memberOf RandomWordGenerator
     */
    static animals = fs.readFileSync(RandomWordGenerator.rootDir + "/animals", "utf8").toString().split("\n");

    /**
     * generate a random word
     * 
     * a random word contains 2 adjectives and 1 animal
     * 
     * @static
     * @returns {string} the random name
     * 
     * @memberOf RandomWordGenerator
     */
    static generateRandomWord(): string {
        return _.sample(RandomWordGenerator.adjectives) + _.sample(RandomWordGenerator.adjectives) + _.sample(RandomWordGenerator.animals);
    }

}